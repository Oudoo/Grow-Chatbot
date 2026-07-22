"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  Bot,
  BotProvider,
  Dialect,
  Language,
  ProviderId,
} from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { IconTrash } from "@/components/icons";

interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
}

interface BotFormProps {
  mode: "create" | "edit";
  bot?: Bot;
  providers: ProviderInfo[];
  defaultProvider: ProviderId;
  availableTools: string[];
  availableMcpServers: { id: string; name: string }[];
}

interface FormState {
  name: string;
  description: string;
  language: Language;
  dialect: Dialect;
  persona: string;
  knowledge: string;
  welcomeMessage: string;
  provider: BotProvider;
  model: string;
  temperature: number;
  tools: string[];
  mcpServers: string[];
  status: "active" | "draft";
}

const DIALECTS: Dialect[] = [
  "auto",
  "msa",
  "gulf",
  "levantine",
  "egyptian",
  "maghrebi",
];

export function BotForm({
  mode,
  bot,
  providers,
  defaultProvider,
  availableTools,
  availableMcpServers,
}: BotFormProps) {
  const { t, dir } = useLang();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: bot?.name ?? "",
    description: bot?.description ?? "",
    language: bot?.language ?? "ar",
    dialect: bot?.dialect ?? "auto",
    persona: bot?.persona ?? "",
    knowledge: bot?.knowledge ?? "",
    welcomeMessage: bot?.welcomeMessage ?? "",
    provider: bot?.provider ?? "default",
    model: bot?.model ?? "",
    temperature: bot?.temperature ?? 0.4,
    tools: bot?.tools ?? [],
    mcpServers: bot?.mcpServers ?? [],
    status: bot?.status ?? "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleTool(name: string) {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(name)
        ? f.tools.filter((x) => x !== name)
        : [...f.tools, name],
    }));
    setSaved(false);
  }

  function toggleMcp(id: string) {
    setForm((f) => ({
      ...f,
      mcpServers: f.mcpServers.includes(id)
        ? f.mcpServers.filter((x) => x !== id)
        : [...f.mcpServers, id],
    }));
    setSaved(false);
  }

  const toolLabels = t.tools.labels as Record<string, string>;

  async function submit() {
    if (!form.name.trim()) {
      setError(t.bots.name);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = mode === "create" ? "/api/bots" : `/api/bots/${bot!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, model: form.model || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      if (mode === "create") {
        router.push(`/dashboard/bots/${data.bot.id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!bot) return;
    if (!window.confirm(t.bots.deleteConfirm)) return;
    setSaving(true);
    try {
      await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
      router.push("/dashboard/bots");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const defaultLabel =
    providers.find((p) => p.id === defaultProvider)?.label ?? defaultProvider;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <Field label={t.bots.name}>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label={t.bots.status}>
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) =>
              set("status", e.target.value as FormState["status"])
            }
          >
            <option value="active">{t.bots.active}</option>
            <option value="draft">{t.bots.draft}</option>
          </select>
        </Field>

        <Field label={t.bots.description} full>
          <input
            className={inputCls}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <Field label={t.bots.language}>
          <select
            className={inputCls}
            value={form.language}
            onChange={(e) => set("language", e.target.value as Language)}
          >
            <option value="ar">{t.langNames.ar}</option>
            <option value="en">{t.langNames.en}</option>
          </select>
        </Field>
        <Field label={t.bots.dialect}>
          <select
            className={inputCls}
            value={form.dialect}
            disabled={form.language !== "ar"}
            onChange={(e) => set("dialect", e.target.value as Dialect)}
          >
            {DIALECTS.map((d) => (
              <option key={d} value={d}>
                {t.dialects[d]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.bots.persona} full>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={form.persona}
            onChange={(e) => set("persona", e.target.value)}
          />
        </Field>

        <Field label={t.bots.knowledge} hint={t.bots.knowledgeHint} full>
          <textarea
            className={`${inputCls} min-h-[120px] resize-y`}
            value={form.knowledge}
            onChange={(e) => set("knowledge", e.target.value)}
          />
        </Field>

        <Field label={t.bots.welcome} full>
          <input
            className={inputCls}
            value={form.welcomeMessage}
            onChange={(e) => set("welcomeMessage", e.target.value)}
          />
        </Field>
      </div>

      {/* Backend AI configuration */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <Field label={t.bots.provider} hint={t.bots.providerHint}>
          <select
            className={inputCls}
            value={form.provider}
            onChange={(e) => set("provider", e.target.value as BotProvider)}
          >
            <option value="default">
              {t.bots.providerDefault} — {defaultLabel}
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.configured ? "" : ` (${t.bots.notConfigured})`}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t.bots.model} (${t.common.optional})`}>
          <input
            className={inputCls}
            value={form.model}
            placeholder="—"
            onChange={(e) => set("model", e.target.value)}
          />
        </Field>
        <Field label={`${t.bots.temperature}: ${form.temperature.toFixed(1)}`} full>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.temperature}
            onChange={(e) => set("temperature", Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </Field>
      </div>

      {/* Agentic tools */}
      {availableTools.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-700">
            {t.tools.title}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{t.tools.hint}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availableTools.map((name) => {
              const checked = form.tools.includes(name);
              return (
                <label
                  key={name}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-brand-300 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTool(name)}
                    className="accent-brand-600"
                  />
                  <span className="font-medium text-slate-700">
                    {toolLabels[name] ?? name}
                  </span>
                  <span
                    dir="ltr"
                    className="ms-auto font-mono text-[11px] text-slate-400"
                  >
                    {name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* MCP servers */}
      {availableMcpServers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-700">
            {t.botMcp.title}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{t.botMcp.hint}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availableMcpServers.map((s) => {
              const checked = form.mcpServers.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-violet-300 bg-violet-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMcp(s.id)}
                    className="accent-violet-600"
                  />
                  <span className="font-medium text-slate-700">{s.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className="flex items-center gap-3"
        style={{ flexDirection: dir === "rtl" ? "row-reverse" : "row" }}
      >
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? t.common.saving : t.bots.save}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600">{t.common.saved}</span>
        )}
        {mode === "edit" && (
          <button
            onClick={remove}
            disabled={saving}
            className="ms-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <IconTrash className="h-4 w-4" />
            {t.common.delete}
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400";

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
