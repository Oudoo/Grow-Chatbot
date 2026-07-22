"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking";
type PlayItem = { url: string } | { browser: string };
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const VOICE_MODEL = "eleven_flash_v2_5"; // low-latency ElevenLabs model
const MIN_CHUNK = 12; // min chars before flushing a sentence to TTS

/**
 * Hands-free, low-latency voice call with Maya. Continuously listens (no
 * tap-to-talk), streams the reply from /api/voice/stream, renders the text as
 * it arrives, and speaks each sentence the moment it's ready via ElevenLabs
 * (Flash) — falling back to the browser voice if /api/tts fails.
 */
export function MayaLive({ botId, welcome }: { botId: string; welcome?: string }) {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>(
    welcome ? [{ role: "assistant", content: welcome }] : [],
  );

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const turnActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const historyRef = useRef<Msg[]>([]);
  const pendingRef = useRef("");
  const assistantTextRef = useRef("");
  const ttsQueueRef = useRef<string[]>([]);
  const playQueueRef = useRef<PlayItem[]>([]);
  const ttsBusyRef = useRef(false);
  const playBusyRef = useRef(false);
  const streamDoneRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function updatePhase(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
    if (!SR) setSupported(false);
    const loadVoice = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      voiceRef.current =
        voices.find((v) => v.lang.toLowerCase().startsWith("ar-eg")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("ar")) ||
        null;
    };
    loadVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoice);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoice);
      stopConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function setAssistantText(text: string) {
    setMessages((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = { role: "assistant", content: text };
          break;
        }
      }
      return copy;
    });
  }

  // --- sentence chunking -------------------------------------------------
  function drainSentences(final: boolean) {
    const text = pendingRef.current;
    const isBoundary = (c: string) => ".!?؟؛…\n".includes(c);
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      if (isBoundary(text[i])) {
        const chunk = text.slice(start, i + 1).trim();
        if (chunk.length >= MIN_CHUNK) {
          enqueueTts(chunk);
          start = i + 1;
        }
      }
    }
    const remainder = text.slice(start);
    if (final) {
      const tail = remainder.trim();
      if (tail) enqueueTts(tail);
      pendingRef.current = "";
    } else {
      pendingRef.current = remainder;
    }
  }

  function enqueueTts(sentence: string) {
    ttsQueueRef.current.push(sentence);
    void pumpTts();
  }

  async function pumpTts() {
    if (ttsBusyRef.current) return;
    ttsBusyRef.current = true;
    while (ttsQueueRef.current.length) {
      const sentence = ttsQueueRef.current.shift() as string;
      let item: PlayItem;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: sentence, model: VOICE_MODEL }),
        });
        if (!res.ok) throw new Error("tts");
        const blob = await res.blob();
        item = { url: URL.createObjectURL(blob) };
      } catch {
        item = { browser: sentence }; // fall back to the browser voice
      }
      playQueueRef.current.push(item);
      void pumpPlay();
    }
    ttsBusyRef.current = false;
    maybeFinishTurn();
  }

  async function pumpPlay() {
    if (playBusyRef.current) return;
    playBusyRef.current = true;
    updatePhase("speaking");
    while (playQueueRef.current.length) {
      const item = playQueueRef.current.shift() as PlayItem;
      if (!activeRef.current) {
        if ("url" in item) URL.revokeObjectURL(item.url);
        continue;
      }
      try {
        if ("url" in item) await playAudio(item.url);
        else await playBrowser(item.browser);
      } catch {
        /* skip a failed clip */
      }
    }
    playBusyRef.current = false;
    maybeFinishTurn();
  }

  function playAudio(url: string) {
    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(() => done());
    });
  }

  function playBrowser(text: string) {
    return new Promise<void>((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voiceRef.current?.lang || "ar-EG";
        if (voiceRef.current) u.voice = voiceRef.current;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }

  // Restart listening once the reply is fully streamed and spoken.
  function maybeFinishTurn() {
    if (!turnActiveRef.current) return;
    if (
      !streamDoneRef.current ||
      ttsBusyRef.current ||
      playBusyRef.current ||
      ttsQueueRef.current.length ||
      playQueueRef.current.length
    ) {
      return;
    }
    turnActiveRef.current = false;
    if (activeRef.current) startListening();
    else updatePhase("idle");
  }

  // --- one turn ----------------------------------------------------------
  async function handleUserSpeech(text: string) {
    stopRecognition();
    updatePhase("thinking");
    turnActiveRef.current = true;
    streamDoneRef.current = false;
    pendingRef.current = "";
    assistantTextRef.current = "";
    setError(null);
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    const historyToSend = historyRef.current.slice(-12);
    try {
      const res = await fetch("/api/voice/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, message: text, history: historyToSend }),
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as {
              delta?: string;
              done?: boolean;
              error?: string;
            };
            if (evt.delta) {
              assistantTextRef.current += evt.delta;
              setAssistantText(assistantTextRef.current);
              pendingRef.current += evt.delta;
              drainSentences(false);
            } else if (evt.error) {
              setError(evt.error);
            }
          } catch {
            /* ignore partial frames */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "connection failed");
    } finally {
      drainSentences(true);
      streamDoneRef.current = true;
      historyRef.current.push({ role: "user", content: text });
      historyRef.current.push({
        role: "assistant",
        content: assistantTextRef.current,
      });
      if (historyRef.current.length > 16) {
        historyRef.current = historyRef.current.slice(-16);
      }
      maybeFinishTurn();
    }
  }

  // --- recognition -------------------------------------------------------
  function stopRecognition() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
  }

  function startListening() {
    if (!activeRef.current) return;
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
    stopRecognition();
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let got = false;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim();
      if (text) {
        got = true;
        handleUserSpeech(text);
      }
    };
    rec.onerror = (ev: { error?: string }) => {
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        setError("الميكروفون مرفوض. اسمح بالوصول للميكروفون وحاول تاني.");
        stopConversation();
      }
    };
    rec.onend = () => {
      // Keep the mic open (hands-free) until the user actually speaks.
      if (!got && activeRef.current && phaseRef.current === "listening") {
        startListening();
      }
    };
    recognitionRef.current = rec;
    updatePhase("listening");
    try {
      rec.start();
    } catch {
      /* start can throw if called too soon; onend will retry */
    }
  }

  // --- conversation lifecycle -------------------------------------------
  function startConversation() {
    setError(null);
    activeRef.current = true;
    setActive(true);
    startListening();
  }

  function stopConversation() {
    activeRef.current = false;
    setActive(false);
    turnActiveRef.current = false;
    stopRecognition();
    try {
      currentAudioRef.current?.pause();
    } catch {
      /* noop */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    ttsQueueRef.current = [];
    playQueueRef.current = [];
    updatePhase("idle");
  }

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
        متصفحك لا يدعم المحادثة الصوتية. جرّب Chrome أو Edge على الكمبيوتر.
      </div>
    );
  }

  const status =
    phase === "listening"
      ? "بستمع… اتكلم"
      : phase === "thinking"
        ? "بفكر…"
        : phase === "speaking"
          ? "بتكلم…"
          : "اضغط الزر وابدأ الكلام مع مايا";

  return (
    <div dir="rtl" className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
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
              {m.content || (m.role === "assistant" && phase === "thinking" ? "…" : m.content)}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 border-t border-slate-200 bg-white p-5">
        <div className="h-5 text-sm font-medium text-brand-700">{status}</div>
        <button
          onClick={active ? stopConversation : startConversation}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
            !active
              ? "bg-brand-600 hover:bg-brand-700"
              : phase === "listening"
                ? "animate-pulse bg-red-500"
                : "bg-slate-500"
          }`}
          aria-label={active ? "end call" : "start call"}
        >
          {active ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
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
          )}
        </button>
        <div className="text-[11px] text-slate-400">
          {active ? "اضغط لإنهاء المكالمة" : "مكالمة صوتية بدون أزرار — اتكلم بحرية"}
        </div>
      </div>
    </div>
  );
}

// Minimal Web Speech API typings (not in the standard DOM lib).
interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onerror: (e: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
