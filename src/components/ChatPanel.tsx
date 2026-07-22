"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, ProviderMeta, ToolInvocation } from "@/lib/types";
import { IconSend } from "@/components/icons";

export interface ChatLabels {
  placeholder: string;
  typing: string;
  via: string;
  fellBack: string;
  errorPrefix: string;
  handoffNotice: string;
  agentBadge: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  meta?: ProviderMeta;
  tools?: ToolInvocation[];
  byAgent?: boolean;
  error?: boolean;
}

interface ServerMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  byAgent?: boolean;
  tools?: ToolInvocation[];
}

interface ChatPanelProps {
  botId: string;
  channel: Channel;
  dir: "rtl" | "ltr";
  welcomeMessage?: string;
  labels: ChatLabels;
  showMeta?: boolean;
  /** Resolve a tool name to a display label (defaults to the raw name). */
  toolLabel?: (name: string) => string;
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
  toolLabel = (name) => name,
  resetKey = 0,
  apiBase = "",
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [handoff, setHandoff] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed / reset with the welcome message.
  useEffect(() => {
    setMessages(
      welcomeMessage ? [{ role: "assistant", content: welcomeMessage }] : [],
    );
    setConversationId(undefined);
    setInput("");
    setHandoff(false);
    seenIds.current = new Set();
  }, [welcomeMessage, resetKey, botId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Poll for new assistant/agent messages so human-agent replies (during a
  // handoff) appear without a page reload.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/chat?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (!res.ok || !active) return;
        const data = (await res.json()) as {
          status?: string;
          messages?: ServerMessage[];
        };
        if (typeof data.status === "string") {
          setHandoff(data.status === "handoff");
        }
        const incoming = (data.messages ?? []).filter(
          (m) => m.role === "assistant" && !seenIds.current.has(m.id),
        );
        if (incoming.length) {
          for (const m of incoming) seenIds.current.add(m.id);
          setMessages((cur) => [
            ...cur,
            ...incoming.map((m) => ({
              role: "assistant" as const,
              content: m.content,
              tools: m.tools,
              byAgent: m.byAgent,
            })),
          ]);
        }
      } catch {
        /* transient network errors are ignored */
      }
    };
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [conversationId, apiBase]);

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
      if (data.userMessageId) seenIds.current.add(data.userMessageId);
      if (data.messageId) seenIds.current.add(data.messageId);
      if (typeof data.status === "string") {
        setHandoff(data.status === "handoff");
      }
      if (data.reply) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply,
            meta: data.meta,
            tools: data.tools,
          },
        ]);
      }
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
                      : m.byAgent
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.byAgent && (
                <div className="mt-1 px-1 text-[11px] font-medium text-indigo-500">
                  {labels.agentBadge}
                </div>
              )}
              {m.role === "assistant" && m.tools && m.tools.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 px-1">
                  {m.tools.map((inv, j) => (
                    <span
                      key={j}
                      title={inv.result}
                      className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
                    >
                      🔧 {toolLabel(inv.name)}
                    </span>
                  ))}
                </div>
              )}
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

        {handoff && (
          <div className="flex justify-center">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-600">
              {labels.handoffNotice}
            </span>
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
