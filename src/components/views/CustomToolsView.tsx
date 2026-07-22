"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomTool } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { IconPlus, IconTrash } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400";

interface ParamRow {
  name: string;
  description: string;
}

export function CustomToolsView({
  tools,
  builtinNames,
}: {
  tools: CustomTool[];
  builtinNames: string[];
}) {
  const { t } = useLang();
  const router = useRouter();
  const toolLabels = t.tools.labels as Record<string, string>;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<ParamRow[]>([]);
  const [headersText, setHeadersText] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateParam(i: number, field: keyof ParamRow, value: string) {
    setParams((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
  }

  async function create() {
    setError(null);
    let headers: Record<string, string> | undefined;
    if (headersText.trim()) {
      try {
        headers = JSON.parse(headersText) as Record<string, string>;
      } catch {
        setError("Headers must be valid JSON");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          method,
          url,
          params,
          headers,
          bodyTemplate: method === "POST" ? bodyTemplate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setName("");
      setDescription("");
      setUrl("");
      setParams([]);
      setHeadersText("");
      setBodyTemplate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.customTools.deleteConfirm)) return;
    await fetch(`/api/tools/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <PageHeader title={t.customTools.title} subtitle={t.customTools.subtitle} />

      {/* Create form */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.customTools.name}
          </span>
          <input
            dir="ltr"
            className={inputCls}
            value={name}
            placeholder="get_weather"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.customTools.method}
          </span>
          <select
            className={inputCls}
            value={method}
            onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.customTools.description}
          </span>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.customTools.url}
          </span>
          <input
            dir="ltr"
            className={inputCls}
            value={url}
            placeholder="https://api.example.com/q?x={query}"
            onChange={(e) => setUrl(e.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-400">
            {t.customTools.urlHint}
          </span>
        </label>

        {/* Params */}
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {t.customTools.params}
            </span>
            <button
              onClick={() => setParams((p) => [...p, { name: "", description: "" }])}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t.customTools.addParam}
            </button>
          </div>
          <div className="space-y-2">
            {params.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  dir="ltr"
                  className={inputCls}
                  value={p.name}
                  placeholder={t.customTools.paramName}
                  onChange={(e) => updateParam(i, "name", e.target.value)}
                />
                <input
                  className={inputCls}
                  value={p.description}
                  placeholder={t.customTools.paramDesc}
                  onChange={(e) => updateParam(i, "description", e.target.value)}
                />
                <button
                  onClick={() => setParams((ps) => ps.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="remove"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {t.customTools.headers}
          </span>
          <textarea
            dir="ltr"
            className={`${inputCls} min-h-[60px] resize-y font-mono text-xs`}
            value={headersText}
            placeholder='{ "Authorization": "Bearer ..." }'
            onChange={(e) => setHeadersText(e.target.value)}
          />
        </label>

        {method === "POST" && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t.customTools.body}
            </span>
            <textarea
              dir="ltr"
              className={`${inputCls} min-h-[60px] resize-y font-mono text-xs`}
              value={bodyTemplate}
              placeholder='{ "q": "{query}" }'
              onChange={(e) => setBodyTemplate(e.target.value)}
            />
          </label>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            onClick={create}
            disabled={saving || !name.trim() || !url.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <IconPlus className="h-4 w-4" />
            {t.customTools.create}
          </button>
        </div>
      </div>

      {/* Existing custom tools */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          {t.customTools.title}
        </h2>
        {tools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t.customTools.empty}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {tools.map((tool) => (
                <li
                  key={tool.id}
                  className="flex items-start justify-between gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        {tool.method}
                      </span>
                      <span dir="ltr" className="font-mono text-sm text-slate-800">
                        {tool.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tool.description}
                    </p>
                    <p dir="ltr" className="mt-0.5 truncate text-xs text-slate-400">
                      {tool.url}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(tool.id)}
                    className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                    aria-label="delete"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Built-in tools reference */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          {t.customTools.builtinTitle}
        </h2>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          {builtinNames.map((n) => (
            <span
              key={n}
              className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
            >
              {toolLabels[n] ?? n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
