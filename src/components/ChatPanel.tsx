"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, ProviderMeta } from "@/lib/types";
import { IconSend } from "@/components/icons";

export interface ChatLabels {
  placeholder: string;
  typing: string;
  via: string;
  fellBack: string;
  errorPrefix: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  meta?: ProviderMeta;
  error?: boolean;
}

interface ChatPanelProps {
  botId: string;
  channel: Channel;
  dir: "rtl" | "ltr";
  welcomeMessage?: string;
  labels: ChatLabels;
  showMeta?: boolean;
  /** Bump this value to reset the conversation from the parent. */
  resetKey?: number;
  apiBase?: string;
}

export function ChatPanel({
  botId,
  channel,
  dir,
  welcomeMessage,
  labels,
  showMeta = false,
  resetKey = 0,
  apiBase = "",
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed / reset with the welcome message.
  useEffect(() => {
    setMessages(
      welcomeMessage
        ? [{ role: "assistant", content: welcomeMessage }]
        : [],
    );
    setConversationId(undefined);
    setInput("");
  }, [welcomeMessage, resetKey, botId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, message: text, conversationId, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, meta: data.meta },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `${labels.errorPrefix}: ${msg}`,
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" dir={dir}>
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[78%]">
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : m.error
                      ? "bg-red-50 text-red-700"
                      : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100"
                }`}
              >
                {m.content}
              </div>
              {showMeta && m.meta && (
                <div className="mt-1 px-1 text-[11px] text-slate-400">
                  {labels.via} {m.meta.provider} · {m.meta.model} ·{" "}
                  {m.meta.latencyMs}ms
                  {m.meta.fellBack ? ` · ${labels.fellBack}` : ""}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
              <span className="flex items-center gap-1">
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={labels.placeholder}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
            aria-label="send"
          >
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  );
}
